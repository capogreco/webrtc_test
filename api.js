export const handle_api = async (req, path_array) => {
   const type = path_array[1]

   const bc = new BroadcastChannel (`program`)
   const db = await Deno.openKv ()

   const get_offer = async () => {
      const { value } = await db.get ([ `offer` ])
      return value
   }

   const synth_start = async controller => {

      controller.enqueue (`data: ${ JSON.stringify ({
         type: `welcome`,
         msg: `event stream established`,
         offer: await get_offer (),
      }) } \n\n`)

      bc.onmessage = async e => {
         if (e.data === `new_offer`) {
            const payload = JSON.stringify ({
               type: `new_offer`,
               offer: await get_offer (),
            })
            controller.enqueue (`data: ${ payload } \n\n`)
         }
      }
   }

   const ctrl_start = async controller => {
      controller.enqueue (`data: ${ JSON.stringify ({
         type: `welcome`,
         msg: `event stream established`,
      }) } \n\n`)

      bc.onmessage = async e => {

         console.log (`bc: ${ e.data }`)
         if (e.data === `new_synth_answer`) {
            const offer = await get_offer ()
            const payload = JSON.stringify ({
               type: `synth_answer`,
               offer
            })
            controller.enqueue (`data: ${ payload } \n\n`)
         }

         if (e.data.startsWith (`new_synth_ice`)) {
            const payload = JSON.stringify ({
               type: `new_synth_ice`,
               candidate: e.data.slice (15),
            })
            controller.enqueue (`data: ${ payload } \n\n`)
         }
      }
   }


   const cancel = () => bc.close ()

   const ctrl_handler = {
      listen: () => {
         const body = new ReadableStream ({ 
            start: ctrl_start, 
            cancel 
         })
         const stream = body.pipeThrough (new TextEncoderStream ())
         const headers = new Headers ({
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
         })
         return new Response (stream, { headers })
      },

      new_offer: async () => {
         const { id, offer} = await req.json ()
         const { ok } = await db.set ([ `offer` ], {
            ctrl: {
               id,
               offer,
               ice_candidates: [],
            },
            synth: {
               id: null,
               answer: null,
               ice_candidates: [],
            },
         }) 
         if (ok) bc.postMessage (`new_offer`)
         return new Response ()
      },

      add_ice: async () => {
         const { id, new_candidate } = await req.json ()
         const offer = await get_offer ()
         if (id != offer.ctrl.id) {
            console.log (`id mismatch`)
            return new Response ()
         }
         offer.ctrl.ice_candidates.push (new_candidate)
         const { ok } = await db.set ([ `offer` ], offer)
         if (ok) bc.postMessage (`new_ctrl_ice`)
         return new Response ()
      },
   }

   const synth_handler = {
      listen: () => {
         const body = new ReadableStream ({ 
            start: synth_start, 
            cancel 
         })
         const stream = body.pipeThrough (new TextEncoderStream ())
         const headers = new Headers ({
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
         })
         return new Response (stream, { headers })
      },

      answer: async () => {
         console.log (`synth_answer`)
         const { offer } = await req.json ()
         const { ok } = await db.set ([ `offer` ], offer)
         if (ok) bc.postMessage (`new_synth_answer`)
         return new Response ()
      },

      add_ice: async () => {
         const { id, new_candidate } = await req.json ()

         const offer = await get_offer ()
         if (id != offer.synth.id) {
            console.log (`id mismatch`)
            return new Response ()
         }
         offer.synth.ice_candidates.push (new_candidate)
         const { ok } = await db.set ([ `offer` ], offer)
         if (ok) bc.postMessage (`new_synth_ice: ${ new_candidate }`)
         return new Response ()
      },
   }

   const es_handler = {
      synth: synth_handler,
      ctrl: ctrl_handler,
   }

   return es_handler[path_array[1]][path_array[2]] () 
}
