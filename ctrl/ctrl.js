document.body.style.background = `black` 
document.body.style.overflow = `hidden`
document.body.style.margin = 0

const id = crypto.randomUUID ()
const es = new EventSource (`/api/ctrl/listen`)

// WebRTC App Step 1
const local_stream = await navigator.mediaDevices.getUserMedia ({
   video: true, 
   audio: false
})
const local_cam = document.getElementById (`local_cam`)
local_cam.srcObject = local_stream

// WebRTC App Step 2 & 3
const pc = new RTCPeerConnection({
   iceServers: [ {
      urls: [
         `stun:stun.l.google.com:19302`,
         `stun:stun1.l.google.com:19302`,
      ]
   } ]
})


// WebRTC App Step 4
local_stream.getTracks ().forEach (track => {
   pc.addTrack (track, local_stream)
})

// WebRTC App Step 5
const offer = await pc.createOffer ()

// WebRTC App Step 6 (& 7)
pc.setLocalDescription (offer)

// WebRTC App Step 8
fetch (`/api/ctrl/new_offer`, {
   method: `POST`,
   headers: { "content-type": `application/json` },
   body: JSON.stringify ({ id, offer }),
})

// WebRTC App Step 9
pc.onicecandidate = e => {
   // console.log (`new ice candidate: ${ JSON.stringify (pc.localDescription) }`)
   console.log (`new ice candidate`)
   fetch (`/api/ctrl/add_ice`, {
      method: `POST`,
      headers: { "content-type": `application/json` },
      body: JSON.stringify ({
         id,
         new_candidate: e.candidate,
      }),
   })
}

es.onmessage = async e => {
   const { data } = e
   const json = JSON.parse (data)
   const { type } = json

   if (type === `welcome`) {
      console.log (json.msg)
   }

   if (type === `synth_answer`) {
      console.log (`synth answer achieved`)
      const { offer } = json
      await pc.setRemoteDescription (offer.synth.answer)
      console.log (`remote description set`)
   }

   if (type === `new_synth_ice`) {
      console.log (`new synth ice candidate`)
      await pc.addIceCandidate (json.candidate)
   }
   // console.dir (`es:`, payload)
}


pc.onsignalingstatechange = e => {
   console.log (`signaling state: ${ pc.signalingState }`)
}

pc.ontrack = e => {
   console.log (`new track`)
   e.streams[0].getTracks ().forEach (track => {
      const vid = document.createElement (`video`)
      vid.autoplay = true
      vid.controls = true
      vid.srcObject = new MediaStream ([ track ])
      document.body.appendChild (vid)
      console.dir (vid)

      // remote_stream.addTrack (track, remote_stream)
   })
}


const dc = pc.createDataChannel (`data`)
dc.onopen    = e => console.log (`data channel opened`)
dc.onclose   = e => console.log (`data channel closed`)
dc.onmessage = e => console.log (`from data channel: ${ e.data }`)

