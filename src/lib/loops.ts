import { LoopsClient } from "loops";

function getLoops() {
  return new LoopsClient(process.env.LOOPS_API_KEY as string);
}

export async function createLoopsContact(email: string, username: string) {
  const loops = getLoops();
  await loops.createContact({ email, properties: { username } });
}

export async function sendLoopsEvent(email: string, eventName: string) {
  const loops = getLoops();
  await loops.sendEvent({ email, eventName });
}
