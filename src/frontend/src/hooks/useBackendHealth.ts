import { useEffect, useState } from "react";
import { useActor } from "./useActor";

export type BackendHealth = "connected" | "disconnected" | "checking";

export function useBackendHealth() {
  const { actor, isFetching } = useActor();
  const [health, setHealth] = useState<BackendHealth>("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    if (isFetching) {
      setHealth("checking");
      return;
    }
    if (!actor) {
      setHealth("disconnected");
      return;
    }
    setHealth("connected");
    setLastChecked(new Date());
  }, [actor, isFetching]);

  return { health, lastChecked, isConnected: health === "connected" };
}
