import React,{useEffect,useRef,useState} from "react";
import {API_BASE_URL} from "../../config/api";
export default function ProjectTestsPanel({context,patch,rescanJobId,onVerified}){
 const [job,setJob]=useState(null),[approved,setApproved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const active=useRef(true),pending=useRef(null);
 const base=`${API_BASE_URL}/scans/${context.scanId}/findings/${context.findingId}/project-tests`;
 useEffect(()=>{active.current=true;return()=>{active.current=false;pending.current?.abort();};},[]);
 async function act(action){
  pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);setError("");
  try{
   const response=await fetch(action==="start"?base:`${base}/${job.id}${action==="cancel"?"/cancel":""}`,{
    method:action==="refresh"?"GET":"POST",credentials:"include",signal:controller.signal,
    ...(action==="refresh"?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(action==="start"?{patch,rescanJobId,acknowledged:approved}:{})})});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error?.message||"Project tests could not be checked.");
   if(active.current&&!controller.signal.aborted&&pending.current===controller){const next=payload.data.job;setJob(next);onVerified(next.status==="completed"&&next.result?.status==="passed"?next.id:null);}
  }catch(e){if(active.current&&e.name!=="AbortError")setError(e.message);}
  finally{if(active.current&&pending.current===controller)setBusy(false);}
 }
 const running=job&&["queued","running"].includes(job.status);
 useEffect(()=>{if(!running||busy||error)return;const timer=setTimeout(()=>act("refresh"),4000);return()=>clearTimeout(timer);},[job,busy,error]);
 const passed=job?.status==="completed"&&job.result?.status==="passed";
 return <section aria-label="Isolated project tests" className="space-y-3 rounded-md border border-text-primary/10 bg-bg-secondary p-4">
  <h3 className="text-sm font-semibold">Run repository tests</h3>
  <p className="text-xs leading-5 text-text-muted">Runs npm test on the baseline and proposed source in separate, restricted GitHub-hosted containers. Supports a root package or backend/frontend packages with npm lockfiles. Dependency installation scripts are disabled. Tests have no network access or application credentials.</p>
  {!running&&<><label className="block text-xs text-text-primary"><input type="checkbox" className="mr-2 accent-accent-security" checked={approved} onChange={e=>setApproved(e.target.checked)}/>I approve isolated execution of this repository’s test scripts.</label>
   <button type="button" className="text-sm font-medium text-accent-security underline disabled:opacity-50" disabled={!approved||busy} onClick={()=>act("start")}>{busy?"Starting tests…":job?"Run project tests again":"Run project tests"}</button></>}
  {running&&<><p role="status" className="text-sm">{job.status==="queued"?"Queued — waiting for GitHub’s runner.":"Running dependency preparation, baseline tests and proposed tests…"}</p>
   <button type="button" disabled={busy} className="text-xs underline" onClick={()=>act("cancel")}>Cancel project tests</button></>}
  {job?.status==="completed"&&<div role="status" className="space-y-2 text-sm"><p className={passed?"text-severity-low":"text-severity-medium"}>{passed?"Baseline and proposed project tests passed":job.result?.status==="unavailable"?"Tests unavailable — no passing result claimed":"Project tests did not pass"}</p>
   <p className="text-xs text-text-muted">{job.result?.reason?.replaceAll("_"," ").toLowerCase()}</p>
   {job.result?.packages?.map(item=><p key={item.root} className="text-xs">{item.root}: baseline {item.baseline.status} · proposed {item.proposed.status}</p>)}
   {job.result?.runUrl&&<a href={job.result.runUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-security underline">View runner record</a>}
   <p className="text-xs text-text-muted">A passing result covers these test commands only. It does not establish complete correctness or security.</p></div>}
  {job?.status==="failed"&&<p role="status" className="text-sm text-severity-medium">The runner could not finish. No passing test result was recorded. Retry after checking the runner.</p>}
  {job?.status==="cancelled"&&<p role="status" className="text-sm text-text-muted">Project tests cancelled.</p>}
  {error&&<div role="alert" className="text-sm text-severity-medium">{error}{running&&<button type="button" className="ml-2 underline" onClick={()=>act("refresh")}>Retry test status</button>}</div>}
 </section>;
}
