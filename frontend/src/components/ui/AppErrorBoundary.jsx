import React from "react";
export class AppErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="p-10 space-y-4 text-white"><h1 className="text-xl">This page could not be loaded</h1><p className="text-slate-400">Reload to pick up the latest release, or return to the workspace.</p><button className="underline text-green-300" onClick={() => window.location.reload()}>Reload page</button><a className="ml-5 underline text-green-300" href="/dashboard">Open workspace</a></main>;
  }
}
