import {createContext,useContext} from 'react';
export type AccountSummary={id:string;email:string;displayName:string;fullName:string;avatarId:string|null;avatarUrl:string|null;subscription:string;timezone?:string};
export const AccountContext=createContext<{account:AccountSummary|null;openAccount:()=>void;openPlans:()=>void;logout:()=>void}>({account:null,openAccount:()=>{},openPlans:()=>{},logout:()=>{}});
export const useAccount=()=>useContext(AccountContext);
