import { redirect } from "next/navigation";

/** Old "new transaction" page: the form is now a sheet on the transactions page. */
export default function NewTransactionPage() {
  redirect("/transactions?open=create");
}
