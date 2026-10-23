import React from "react";
import {afterEach,expect,test,vi} from "vitest";
import {cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PatchRescanPanel from "./PatchRescanPanel";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const context={scanId:"scan",findingId:"finding"};
const job={id:"job",status:"completed",patchHash:"a".repeat(64),commitSha:"b".repeat(40),result:{status:"passed",outcome:"target_alert_absent",tests:"not_executed"}};
const response=job=>({ok:true,json:async()=>({data:{job}})});
test("finding proposals can automatically start their exact-patch verification",async()=>{
 const fetch=vi.fn(async()=>response(job));vi.stubGlobal("fetch",fetch);
 render(<PatchRescanPanel context={context} patch="diff" onVerified={vi.fn()} autoStart/>);
 expect(await screen.findByText("Static checks passed — tests not run")).toBeTruthy();expect(fetch).toHaveBeenCalledTimes(1);
});
test("passing static checks are explicitly distinguished from unrun project tests",async()=>{
 const fetch=vi.fn(async()=>response(job)),onVerified=vi.fn();vi.stubGlobal("fetch",fetch);
 render(<PatchRescanPanel context={context} patch="diff" onVerified={onVerified}/>);
 await userEvent.click(screen.getByRole("button",{name:"Rescan proposed fix"}));
 expect(await screen.findByText("Static checks passed — tests not run")).toBeTruthy();expect(onVerified).toHaveBeenCalledWith("job");
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({patch:"diff"});
});
test("remaining target alerts do not enable PR verification",async()=>{
 const onVerified=vi.fn();vi.stubGlobal("fetch",vi.fn(async()=>response({...job,result:{status:"failed",outcome:"target_alert_remains",remainingTargetAlerts:2}})));
 render(<PatchRescanPanel context={context} patch="diff" onVerified={onVerified}/>);
 await userEvent.click(screen.getByRole("button",{name:"Rescan proposed fix"}));
 expect(await screen.findByText(/2 matching alerts remain/)).toBeTruthy();expect(onVerified).toHaveBeenCalledWith(null);
});
test("rejected proposals offer bounded feedback without sending other repository paths",async()=>{
 const onFeedback=vi.fn();vi.stubGlobal("fetch",vi.fn(async()=>response({...job,result:{status:"failed",outcome:"new_alerts_detected",introducedAlerts:1,newAlerts:[{filePath:"private/other.js"}]}})));
 render(<PatchRescanPanel context={context} patch="diff" onVerified={vi.fn()} onFeedback={onFeedback}/>);
 await userEvent.click(screen.getByRole("button",{name:"Rescan proposed fix"}));
 await userEvent.click(await screen.findByRole("button",{name:"Revise with scanner feedback"}));
 expect(onFeedback.mock.calls[0][0]).toContain("introduced additional scanner alerts");expect(onFeedback.mock.calls[0][0]).not.toContain("private/other.js");
});
test("queued work can be cancelled and never appears passed",async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response({...job,status:"queued",result:null})).mockResolvedValueOnce(response({...job,status:"cancelled",result:null}));
 vi.stubGlobal("fetch",fetch);render(<PatchRescanPanel context={context} patch="diff" onVerified={vi.fn()}/>);
 await userEvent.click(screen.getByRole("button",{name:"Rescan proposed fix"}));
 await userEvent.click(await screen.findByRole("button",{name:"Cancel rescan"}));
 expect(await screen.findByText("Rescan cancelled. No fix was confirmed.")).toBeTruthy();expect(fetch.mock.calls[1][0]).toMatch(/\/job\/cancel$/);
});
test("a failed status refresh keeps pending work recoverable",async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response({...job,status:"queued",result:null}))
  .mockResolvedValueOnce({ok:false,json:async()=>({error:{message:"Temporarily unavailable"}})}).mockResolvedValueOnce(response(job));
 vi.stubGlobal("fetch",fetch);render(<PatchRescanPanel context={context} patch="diff" onVerified={vi.fn()}/>);
 await userEvent.click(screen.getByRole("button",{name:"Rescan proposed fix"}));
 await userEvent.click(await screen.findByRole("button",{name:"Refresh rescan"}));
 expect(await screen.findByRole("alert")).toBeTruthy();
 await userEvent.click(screen.getByRole("button",{name:"Retry rescan status"}));
 await waitFor(()=>expect(screen.getByText("Static checks passed — tests not run")).toBeTruthy());
});
