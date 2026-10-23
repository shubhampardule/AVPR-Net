const {validateClaims,AUDIENCE}=require("../src/services/runner-identity.service");
const revision="a".repeat(40),now=1800000000;
const valid=()=>({iss:"https://token.actions.githubusercontent.com",aud:AUDIENCE,repository:"shubhampardule/AVPR-Net",repository_id:"1425869481",repository_owner_id:"166275831",
 ref:"refs/heads/main",sub:"repo:shubhampardule/AVPR-Net:ref:refs/heads/main",workflow_ref:"shubhampardule/AVPR-Net/.github/workflows/project-tests.yml@refs/heads/main",
 sha:revision,workflow_sha:revision,event_name:"repository_dispatch",runner_environment:"github-hosted",run_id:"12345",run_attempt:"1",iat:now-1,nbf:now-1,exp:now+300});
test("only the pinned hosted workflow identity is eligible",()=>expect(validateClaims(valid(),now,revision)).toEqual({runId:"12345",revision,attempt:"1"}));
test("GitHub's immutable-ID subject format is accepted only for this repository and owner",()=>{
 expect(validateClaims({...valid(),sub:"repo:shubhampardule@166275831/AVPR-Net@1425869481:ref:refs/heads/main"},now,revision)).toMatchObject({runId:"12345"});
 expect(()=>validateClaims({...valid(),sub:"repo:shubhampardule@999/AVPR-Net@1425869481:ref:refs/heads/main"},now,revision)).toThrow();
});
test.each(Object.keys(valid()))("a wrong or missing %s claim fails closed",key=>{
 expect(()=>validateClaims({...valid(),[key]:undefined},now,revision)).toThrow();
});
test.each([{exp:now-1},{exp:now+3600},{nbf:now+60},{iat:now-700},{event_name:"pull_request"},{runner_environment:"self-hosted"}])("expired/untrusted runner identity is rejected: %j",change=>expect(()=>validateClaims({...valid(),...change},now,revision)).toThrow());
test("runner is unavailable until an exact revision is configured",()=>expect(()=>validateClaims(valid(),now,"main")).toThrow());
