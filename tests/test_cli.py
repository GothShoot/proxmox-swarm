from proxmox_swarm.cli import build_parser


def test_build_parser_deploy():
    parser = build_parser()
    args = parser.parse_args([
        '--host', 'h',
        '--user', 'u@pam',
        '--password', 'p',
        '--node', 'n1',
        'deploy',
        'stack.yml'
    ])
    assert args.command == 'deploy'
    assert args.stack == 'stack.yml'
    assert args.node == 'n1'


def test_build_parser_start():
    parser = build_parser()
    args = parser.parse_args([
        '--host', 'h',
        '--user', 'u@pam',
        '--password', 'p',
        'start',
        'node1',
        '100'
    ])
    assert args.command == 'start'
    assert args.node == 'node1'
    assert args.vmid == 100
