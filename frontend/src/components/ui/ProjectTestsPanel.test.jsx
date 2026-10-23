import React from "react";
import {afterEach,expect,test,vi} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectTestsPanel from "./ProjectTestsPanel";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const context={scanId:"scan",findingId:"finding"};
const response=job=>({ok:true,json:async()=>({data:{job}})});
test("project test execution requires separate approval and sends exact static proof",async()=>{
 const onVerified=vi.fn(),fetch=vi.fn(async()=>response({id:"tests",status:"completed",result:{status:"passed",reason:"TESTS_PASSED",packages:[]}}));vi.stubGlobal("fetch",fetch);
 render(<ProjectTestsPanel context={context} patch="diff" rescanJobId="rescan" onVerified={onVerified}/>);
 expect(screen.getByRole("button",{name:"Run project tests"}).disabled).toBe(true);
 await userEvent.click(screen.getByRole("checkbox"));await userEvent.click(screen.getByRole("button",{name:"Run project tests"}));
 expect(await screen.findByText("Baseline and proposed project tests passed")).toBeTruthy();
 expect(onVerified).toHaveBeenCalledWith("tests");expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({patch:"diff",rescanJobId:"rescan",acknowledged:true});
});
test("failed test results do not become passing evidence",async()=>{
 const onVerified=vi.fn();vi.stubGlobal("fetch",vi.fn(async()=>response({id:"tests",status:"completed",result:{status:"failed",reason:"PROPOSED_TESTS_FAILED",packages:[]}})));
 render(<ProjectTestsPanel context={context} patch="diff" rescanJobId="rescan" onVerified={onVerified}/>);
 await userEvent.click(screen.getByRole("checkbox"));await userEvent.click(screen.getByRole("button",{name:"Run project tests"}));
 expect(await screen.findByText("Project tests did not pass")).toBeTruthy();expect(onVerified).toHaveBeenCalledWith(null);
});
test("cancellation clears pending test evidence",async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response({id:"tests",status:"queued"})).mockResolvedValueOnce(response({id:"tests",status:"cancelled"}));vi.stubGlobal("fetch",fetch);
 render(<ProjectTestsPanel context={context} patch="diff" rescanJobId="rescan" onVerified={vi.fn()}/>);
 await userEvent.click(screen.getByRole("checkbox"));await userEvent.click(screen.getByRole("button",{name:"Run project tests"}));
 await userEvent.click(await screen.findByRole("button",{name:"Cancel project tests"}));expect(await screen.findByText("Project tests cancelled.")).toBeTruthy();
 expect(fetch.mock.calls[1][0]).toMatch(/\/tests\/cancel$/);
});
