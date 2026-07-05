import { redirect } from "next/navigation";

export default function LegalInboxPage() {
  redirect("/creator/pre/legal-contracts?tab=inbox");
}
