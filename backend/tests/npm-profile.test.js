const path=require("node:path"),{validateManifest,args}=require("../runner/npm-profile.cjs");
const manifest={scripts:{test:"node --test"}},lock={lockfileVersion:3,packages:{"":{name:"fixture"},"node_modules/example":{version:"1.0.0",resolved:"https://registry.npmjs.org/example/-/example-1.0.0.tgz",integrity:"sha512-example"}}};
test("npm locked registry dependencies are accepted without installation scripts",()=>expect(validateManifest(manifest,lock)).toBe(true));
test.each(["http://registry.npmjs.org/a.tgz","https://evil.example/a.tgz","file:../a","git+https://github.com/a/b","https://registry.npmjs.org/a.tgz?token=x"])("unreviewed dependency sources are rejected: %s",resolved=>expect(()=>validateManifest(manifest,{...lock,packages:{a:{resolved,integrity:"sha512-x"}}})).toThrow());
test("workspace links and unlocked packages are refused",()=>{
 expect(()=>validateManifest({...manifest,workspaces:["*"]},lock)).toThrow();
 expect(()=>validateManifest(manifest,{...lock,packages:{a:{link:true}}})).toThrow();
 expect(()=>validateManifest(manifest,{...lock,lockfileVersion:1})).toThrow();
});
test("only dependency preparation has network access and writable metadata",()=>{
 const base=["avpr-test-"+"a".repeat(24),path.resolve("source"),path.resolve("deps"),"backend"];
 const install=args(...base,true),tests=args(...base,false);
 expect(install).toContain("--ignore-scripts");expect(install).not.toContain("test");
 expect(tests).toEqual(expect.arrayContaining(["--network","none","--user","65532:65532","--read-only"]));
 expect(tests.at(-1)).toBe("test");expect(tests).not.toContain("--env-file");expect(tests.join(" ")).not.toContain("docker.sock");
 expect(()=>args(...base.slice(0,3),"../escape",false)).toThrow();
});
