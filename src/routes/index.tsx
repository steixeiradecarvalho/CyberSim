import { createFileRoute } from "@tanstack/react-router";
import { CyberSimpatia } from "@/components/cyber-simpatia";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CyberSimpatia />;
}
