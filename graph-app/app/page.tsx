import { Suspense } from "react";
import GraphView from "../components/GraphView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GraphView />
    </Suspense>
  );
}
