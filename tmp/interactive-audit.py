import os, pty, select, signal, time, tempfile, shutil, pathlib, json

source = pathlib.Path('/mnt/e/Code/z3cz/docker-host/dafthunk-setup')
root = pathlib.Path(tempfile.mkdtemp(prefix='z3cz-interactive-audit-'))
print('TEST_DIR=' + str(root), flush=True)

def run(label, patched=False, pipe=True, answer=''):
    case = root / label
    case.mkdir()
    script = source.read_text().replace('\r\n', '\n')
    if patched:
        script = script.replace('exec </proc/self/fd/1', 'exec </proc/self/fd/1\n    return 0').replace('exec </proc/self/fd/2', 'exec </proc/self/fd/2\n    return 0')
    (case / 'setup').write_text(script)
    bins = case / 'bin'
    bins.mkdir()
    (bins / 'curl').write_text('#!/bin/sh\nprintf 127.0.0.1\n')
    (bins / 'curl').chmod(0o755)
    command = f'env PATH={bins}:/usr/sbin:/usr/bin:/sbin:/bin bash {case}/setup --no-rebuild'
    command = ('cat /dev/null | sudo -u root ' if pipe else 'sudo -u root ') + command
    pid, fd = pty.fork()
    if pid == 0:
        os.execv('/bin/bash', ['bash', '--noprofile', '--norc', '-ic', command])
    output = b''
    sent = False
    exited = False
    start = time.monotonic()
    prompt_time = None
    exit_status = None
    while time.monotonic() - start < 12:
        if select.select([fd], [], [], .1)[0]:
            try:
                data = os.read(fd, 65536)
            except OSError:
                break
            if not data:
                break
            output += data
        if '域名（可直接回车，后续在后台配置）: '.encode() in output and prompt_time is None:
            prompt_time = time.monotonic()
        if prompt_time and not sent and time.monotonic() - prompt_time > 1:
            os.write(fd, (answer + '\n').encode())
            sent = True
        got, status = os.waitpid(pid, os.WNOHANG)
        if got:
            exited = True
            exit_status = os.waitstatus_to_exitcode(status)
            break
    text = output.decode(errors='replace')
    print(json.dumps({'case':label,'sent_after_prompt':sent,'received':'已收到输入' in text,'written':(case/'containers/app.yml').exists(),'exit':exit_status},ensure_ascii=False), flush=True)
    print(text, flush=True)
    os.close(fd)
    if not exited:
        try: os.kill(pid, signal.SIGKILL)
        except ProcessLookupError: pass
        try: os.waitpid(pid, 0)
        except ChildProcessError: pass

run('current-pipe')
run('current-file', pipe=False)
run('return-pipe', patched=True)
run('return-domain', patched=True, answer='test.example.com')
