import ipaddress
import socket
from urllib.parse import urlparse
from typing import Tuple

# Disallowed IP networks
BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),       # Link-local / Cloud metadata (169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.88.99.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),         # Multicast
    ipaddress.ip_network("240.0.0.0/4"),         # Reserved
    ipaddress.ip_network("255.255.255.255/32"),
    # IPv6 blocked ranges
    ipaddress.ip_network("::1/128"),             # Loopback
    ipaddress.ip_network("::/128"),              # Unspecified
    ipaddress.ip_network("fc00::/7"),            # Unique local
    ipaddress.ip_network("fe80::/10"),           # Link-local
    ipaddress.ip_network("ff00::/8"),            # Multicast
]


def is_ip_blocked(ip_addr: str) -> bool:
    """Check if an IPv4 or IPv6 address is in any private, loopback, or metadata network."""
    try:
        ip = ipaddress.ip_address(ip_addr)
        # Check standard properties
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            return True
        for network in BLOCKED_NETWORKS:
            if ip in network:
                return True
        return False
    except ValueError:
        return True


def verify_url_ssrf_safety(url: str) -> Tuple[bool, str]:
    """
    Resolve the DNS of the URL hostname and assert that all resolved IP addresses are public.
    Rejects localhost, private LAN, link-local, and cloud metadata destinations.
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid or missing hostname in URL."

        # If hostname is an IP literal, directly inspect it
        try:
            ipaddress.ip_address(hostname)
            if is_ip_blocked(hostname):
                return False, f"Host '{hostname}' resolves to a restricted or private address."
            return True, ""
        except ValueError:
            pass

        # Perform socket DNS lookup
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        if not addr_info:
            return False, f"Unable to resolve host '{hostname}'."

        for entry in addr_info:
            sockaddr = entry[4]
            ip_str = sockaddr[0]
            if is_ip_blocked(ip_str):
                return False, f"Host '{hostname}' resolves to a restricted IP ({ip_str}). Request blocked."

        return True, ""
    except socket.gaierror:
        return False, f"DNS resolution failed for hostname in '{url}'."
    except Exception as e:
        return False, f"SSRF security verification failed: {str(e)}"
