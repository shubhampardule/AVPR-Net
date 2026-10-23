const {containerArgs,requireHostedVm,IMAGE}=require("../runner/node-profile.cjs");
const path=require("node:path");
test("container profile has a pinned image and fixed nonprivileged resource/network policy",()=>{
 const args=containerArgs("avpr-test-"+"a".repeat(24),path.resolve("fixture"),["test/value.test.cjs"]);
 expect(IMAGE).toMatch(/@sha256:[a-f0-9]{64}$/);expect(args).toEqual(expect.arrayContaining(["--network","none","--read-only","--cap-drop","ALL","--user","65532:65532","--pids-limit","64","--memory","512m","--pull","never"]));
 expect(args.some(arg=>arg.includes("docker.sock"))).toBe(false);expect(args).not.toContain("--privileged");expect(args).not.toContain("--env-file");
 expect(args.slice(-2)).toEqual(["--test","/workspace/test/value.test.cjs"]);
});
test.each(["../escape.test.js","--eval","test/a.test.js;bad","test/subdir/a.test.js"])("arbitrary test commands and paths are rejected: %s",file=>{
 expect(()=>containerArgs("avpr-test-"+"a".repeat(24),path.resolve("fixture"),[file])).toThrow();
});
test("local machines and self-hosted agents cannot enable this hosted-only profile",()=>{
 expect(()=>requireHostedVm({})).toThrow();
 const env={GITHUB_ACTIONS:"true",RUNNER_ENVIRONMENT:"github-hosted",RUNNER_OS:"Linux",RUNNER_ARCH:"X64",RUNNER_TEMP:"/tmp/jobs"};
 expect(()=>requireHostedVm(env)).not.toThrow();
 expect(()=>requireHostedVm({...env,RUNNER_ENVIRONMENT:"self-hosted"})).toThrow();
 expect(()=>requireHostedVm({...env,DOCKER_HOST:"tcp://other-host"})).toThrow();
});
