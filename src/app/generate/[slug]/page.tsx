import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getEvent, listEvents } from "@/lib/templates";
import GenerateClient from "./GenerateClient";

export const dynamicParams = false;

export function generateStaticParams() {
  return listEvents().map((e) => ({ slug: e.slug }));
}

export default async function GeneratePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = getEvent(slug);
  if (!ev) notFound();
  return (
    <>
      <Header crumbs={[{ label: ev.name }]} />
      <GenerateClient ev={ev} />
    </>
  );
}
