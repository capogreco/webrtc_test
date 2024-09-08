import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts"
import { handle_api } from "./api.js"

console.clear ()

const db = await Deno.openKv ()
for await (const { key } of db.list({ prefix: [] })) {
   await db.delete(key)
}

const handler = req => {
   const { pathname } = new URL (req.url)
   const path_array = pathname.slice (1).split (`/`)

   if (path_array[0] === `api`) {
      return handle_api (req, path_array)
   }

   const fsRoot = path_array[0] === `ctrl` ? "" : "synth"
   return serveDir (req, { fsRoot, quiet: true })
}

Deno.serve ({ handler })