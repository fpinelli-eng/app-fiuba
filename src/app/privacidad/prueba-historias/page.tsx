import { WelcomeStories } from "@/components/WelcomeStories";

// TEMPORAL: para mirar las historias sin sesión. Se borra antes de integrar.
export default function Page() {
  return <WelcomeStories firstName="Tomás" open needsOffer term="2C 2026" />;
}
