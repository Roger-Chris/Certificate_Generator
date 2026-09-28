import Header from "@/components/Header";
import SettingsClient from "./SettingsClient";

export default function SettingsPage() {
  return (
    <>
      <Header crumbs={[{ label: "Settings" }]} />
      <SettingsClient />
    </>
  );
}
