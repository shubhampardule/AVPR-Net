const crypto=require("node:crypto");
test("runner tokens require a valid GitHub-key signature, not merely plausible claims",async()=>{
 jest.resetModules();
 const {publicKey,privateKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
 const now=Math.floor(Date.now()/1000),revision="a".repeat(40);
 process.env.PROJECT_TEST_RUNNER_SHA=revision;
 const claims={iss:"https://token.actions.githubusercontent.com",aud:"https://avpr-psi.vercel.app/project-tests",repository:"shubhampardule/AVPR-Net",repository_id:"1425869481",repository_owner_id:"166275831",
  ref:"refs/heads/main",sub:"repo:shubhampardule/AVPR-Net:ref:refs/heads/main",workflow_ref:"shubhampardule/AVPR-Net/.github/workflows/project-tests.yml@refs/heads/main",sha:revision,workflow_sha:revision,
  event_name:"repository_dispatch",runner_environment:"github-hosted",run_id:"12345",run_attempt:"1",iat:now,nbf:now,exp:now+300};
 const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url"),content=`${encode({alg:"RS256",kid:"fixture"})}.${encode(claims)}`;
 const token=`${content}.${crypto.sign("RSA-SHA256",Buffer.from(content),privateKey).toString("base64url")}`;
 const previousFetch=global.fetch;
 global.fetch=jest.fn(async()=>({ok:true,text:async()=>JSON.stringify({keys:[{...publicKey.export({format:"jwk"}),kid:"fixture",alg:"RS256",use:"sig"}]})}));
 try{
  const {verify}=require("../src/services/runner-identity.service");
  await expect(verify(token)).resolves.toMatchObject({runId:"12345",revision});
  await expect(verify(`${content}.${Buffer.alloc(256).toString("base64url")}`)).rejects.toThrow();
  await expect(verify("not.a.valid.jwt")).rejects.toThrow();
  expect(global.fetch).toHaveBeenCalledTimes(1);
 }finally{global.fetch=previousFetch;delete process.env.PROJECT_TEST_RUNNER_SHA;}
});
