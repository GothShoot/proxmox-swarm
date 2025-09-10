import textwrap
from proxmox_swarm.stack import load_stack


def test_load_stack(tmp_path):
    stack_file = tmp_path / "stack.yml"
    stack_file.write_text(textwrap.dedent(
        """
        services:
          web:
            vmid: 100
            image: local:vztmpl/debian-12.tar.gz
            memory: 256
            cores: 2
            bridge: vmbr1
            ip: 10.0.0.2/24
        """
    ))

    services = load_stack(str(stack_file))
    assert len(services) == 1
    svc = services[0]
    assert svc.name == "web"
    params = svc.to_lxc_params()
    assert params["vmid"] == 100
    assert "net0" in params
    assert "bridge=vmbr1" in params["net0"]
