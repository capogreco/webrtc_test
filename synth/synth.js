document.body.style.background = `black` 
document.body.style.overflow = `hidden`
document.body.style.margin = 0


const id = crypto.randomUUID ()
const es = new EventSource (`/api/synth/listen`)
const pc = new RTCPeerConnection({
   iceServers: [ {
      urls: [
         `stun:stun.l.google.com:19302`,
         `stun:stun1.l.google.com:19302`,
      ]
   } ]
})

const local_cam = document.getElementById (`local_cam`)
const remote_cam = document.getElementById (`remote_cam`)

const local_stream = await navigator.mediaDevices.getUserMedia ({
   video: true, 
   audio: false
})

local_cam.srcObject = local_stream

local_stream.getTracks ().forEach (track => {
   pc.addTrack (track, local_stream)
})

const remote_stream = new MediaStream ()
remote_cam.srcObject = remote_stream

es.onmessage = async e => {
   const { data } = e
   const payload = JSON.parse (data)
   console.log (payload)

   if (payload.type === `welcome`) {
      const { msg, offer } = payload
      console.log (msg)
      if (offer) {
         console.log (`ctrl offer received`)
         console.log (offer)
         offer.synth.id = id
         await pc.setRemoteDescription (offer.ctrl.offer)
         offer.synth.answer = await pc.createAnswer ()
         await pc.setLocalDescription (offer.synth.answer)

         console.dir (offer)
         offer.ctrl.ice_candidates.forEach (candidate => {
            pc.addIceCandidate (candidate)
         })

         fetch (`/api/synth/answer`, {
            method: `POST`,
            headers: { "content-type": `application/json` },
            body: JSON.stringify ({ offer }),
         })
      
      }
      else console.log (`no offer yet`)
   }
}

pc.onicecandidate = e => {
   // console.log (`new ice candidate: ${ JSON.stringify (rc.localDescription) }`)
   console.log (`new ice candidate`)

   fetch (`/api/synth/add_ice`, {
      method: `POST`,
      headers: { "content-type": `application/json` },
      body: JSON.stringify ({
         id,
         new_candidate: e.candidate,
      }),
   })
}

pc.ontrack = e => {
   console.log (`new track`)
   e.streams[0].getTracks ().forEach (track => {
      console.log (`track kind: ${ track.kind }`)
      remote_stream.addTrack (track)
   })
}

 
pc.ondatachannel= e => {
   const receiver = e.channel
   receiver.onmessage = e => console.log (`from data channel: ${ e.data }`)
   receiver.onopen = e => console.log (`data channel opened`)
   receiver.onclose = e => console.log (`data channel closed`)
   pc.channel = receiver
}

//create answer