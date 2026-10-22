# Isolated patch verification runner (proposal)

**Status: designed, not implemented.** SecurePatch currently validates a patch against the exact scanned source and performs limited syntax checks. It does not execute repository tests or patched code. Keep that behavior until an isolated runner is deployed, adversarially tested, and reviewed.

## Boundary and deployment

Keep the Vercel application as the control plane for authentication, authorization, scan records, and review. Run verification on a separate Linux service with a hardware virtualization boundary. Start one disposable Firecracker microVM per job through the matching Firecracker Jailer. Do not run repository commands inside the Vercel function, the API process, or the queue controller.

This deployment choice is based on a security boundary the application can configure and test. Vercel documents function duration, memory, and scratch-filesystem limits, but it does not expose controls for AVPR to create per-job namespaces, cgroups, seccomp profiles, or a VM. That conclusion is an architectural inference from the available Vercel runtime controls, not a statement that Vercel's own function isolation is ineffective. Confirm KVM, microVM, networking, and cleanup support with the selected runner host before implementation.

Firecracker's production guidance recommends its Jailer or equivalent constraints: the Jailer applies cgroups and namespaces and drops privileges, while Firecracker's default seccomp filters restrict host system calls. Use a pinned, patched Firecracker release and its matching Jailer; do not use debug builds or disable seccomp. A microVM is defense in depth and still requires host patching, configuration review, and security testing.

## Job flow

1. A member reviews and explicitly starts verification for one proposal. The control plane records the organization, repository, scan ID, immutable base commit, target file, reviewer, patch digest, and selected verification profile.
2. A trusted broker obtains the source snapshot at that exact commit using the existing GitHub authorization, validates archive bounds, and prepares read-only input images. It does not send GitHub, MongoDB, session, NVIDIA, or cloud credentials to the guest.
3. The runner validates a signed, short-lived job envelope and boots a fresh microVM. It copies the source snapshot to a bounded writable workspace, checks the base SHA and patch digest, applies the exact single-file diff with no fuzz, and runs only a predeclared profile. The guest receives no ambient secrets, metadata service, network interface, host socket, shared writable host directory, or arbitrary command field.
4. The supervisor captures bounded output, terminates the guest at the wall-clock deadline or on cancellation, waits for the VM process and cgroup to exit, removes its network namespace and temporary disks, and reaps any orphaned job directory after a crash.
5. The trusted control plane validates and stores a result with the base SHA, patch digest, image/tool versions, and a status for every check. Result states are `passed`, `failed`, `skipped`, or `unavailable`; a skipped or missing check never counts as a pass.

Use an idempotency key scoped to the scan, finding, patch digest, and profile. Accept results only from the runner's authenticated channel and only for the matching job lease. Sanitize and cap logs; never store the guest environment or credential-like output without explicit redaction.

## Initial resource and profile policy

Treat these as conservative starting ceilings to validate on the chosen host, not performance guarantees: one vCPU, 2 GiB guest memory, 2 GiB writable workspace, 100 MiB output/log budget, and a 120-second wall-clock deadline per verification job. Enforce CPU, memory, process count, file size, open files, disk, and elapsed time at the host boundary with cgroups and process limits, then verify the limit behavior under contention. Add cancellation from the UI through the queue and supervisor to forced VM teardown.

The first implementation should offer only reviewed profiles bundled in a digest-pinned image. Do not run arbitrary install scripts or fetch packages from the internet in the guest. Networkless execution may make some project test suites unavailable; report that state explicitly instead of treating it as success. Add dependency preparation only after it has a separate bounded, integrity-checked design.

No profile may change a repository branch or default branch. A passing verification is evidence for the exact patch and commit only; it does not establish security or correctness. Any draft PR remains a separately reviewed action behind owner/admin and GitHub permission checks.

## Required tests before enabling customers

- Escape attempts: path traversal, symlinks, malicious archives, shell metacharacters, fork/process bombs, oversized output, and malformed patches.
- Boundary attempts: guest-to-host access, metadata and network access, host socket or filesystem access, inherited environment/secrets, resource exhaustion, and attempts to alter another job.
- Lifecycle: cancellation during boot and execution, host restart, timeout, duplicate job delivery, runner crash, lease expiry, cleanup failure, and orphan reaping.
- Correctness: wrong base SHA, wrong patch digest, wrong target path, unapplied patch, syntax failure, failing tests, skipped/unavailable profiles, and post-patch scanner findings.
- Operations: patched host image, authenticated result channel, log redaction, capacity/quota enforcement, backup/restore, incident response, and independent security review.

Do not implement patch application or test execution until the runner host, isolation boundary, profile policy, cleanup supervisor, and the tests above are available. Until then, keep syntax checks advisory and record project tests as `not_executed`.

## References

- [Vercel Function runtimes and filesystem support](https://vercel.com/docs/functions/runtimes)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Firecracker production host setup](https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md)
- [Firecracker Jailer](https://github.com/firecracker-microvm/firecracker/blob/main/docs/jailer.md)
- [Firecracker design and sandboxing](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md)
