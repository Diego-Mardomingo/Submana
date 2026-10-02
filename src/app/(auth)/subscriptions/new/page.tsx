import { redirect } from "next/navigation";

/** Old "new subscription" page: the form is now a sheet on the subscriptions page. */
export default function NewSubscriptionPage() {
  redirect("/subscriptions?open=create");
}
