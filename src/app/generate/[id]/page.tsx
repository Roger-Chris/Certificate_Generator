import Header from "@/components/Header";
import GenerateClient from "./GenerateClient";

export default async function GeneratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Header crumbs={[{ label: "Create certificates" }]} />
      <GenerateClient id={id} />
    </>
  );
}
