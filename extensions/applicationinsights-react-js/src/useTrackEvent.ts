/**
 * ReactPlugin.ts
 * @copyright Microsoft 2019
 */
import { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";
import ReactPlugin from "./ReactPlugin";

export type AIReactCustomEvent<T> = Dispatch<SetStateAction<T>>;

export default function useCustomEvent<T>(
  reactPlugin: ReactPlugin,
  eventName: string,
  eventData: T,
  skipFirstRun = true
): AIReactCustomEvent<T> {
  const [data, setData] = useState(eventData);
  const firstRun = useRef(skipFirstRun);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    reactPlugin.trackEvent({ name: eventName }, data);
  }, [reactPlugin, data, eventName]);

  return setData as AIReactCustomEvent<T>;
}
