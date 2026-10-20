# Static scanner contract fixture. Never imported or executed.
import subprocess
def unsafe(command):
    return subprocess.run(command, shell=True)
