/** After a statement import: remember it for the import reminder and tell the other members of a joint account. */
import { notifyAfter } from "../server";
import { jointImportEvents, markAccountImported } from "./joint";

/** `imported` is the number of new movements; one `joint.import` notification covers the whole import. */
export function notifyImport(args: { accountId: string; imported: number; joint: boolean; actorId: string }) {
  notifyAfter(async () => {
    await markAccountImported(args.accountId);
    return args.joint ? jointImportEvents(args.accountId, args.imported, args.actorId) : [];
  });
}
