import { createContext, useContext, Context } from "react";
import ReactPlugin from "./ReactPlugin";

export declare type AppInsightsReactContext = Context<ReactPlugin>
const AppInsightsContext = createContext<ReactPlugin>(undefined) as AppInsightsReactContext;

const useAppInsightsContext = () => useContext(AppInsightsContext);

export { AppInsightsContext, useAppInsightsContext };
