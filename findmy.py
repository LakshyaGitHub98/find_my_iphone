import sys
from datetime import datetime

import click
from rich.console import Console
from rich.table import Table
from rich import print as rprint

from pyicloud import PyiCloudService
from icloud_client import FindMyClient

console = Console()
client = FindMyClient()


def require_auth():
    if not client.is_authenticated():
        rprint("[red]Not logged in. Run [bold]findmy login[/bold] first.[/red]")
        sys.exit(1)


@click.group()
def cli():
    pass


@cli.command()
@click.option("--apple-id", prompt="Apple ID", help="Your iCloud email address")
@click.option("--password", prompt=True, hide_input=True, help="iCloud password")
def login(apple_id, password):
    """Log in to iCloud and cache the session"""
    with console.status("Authenticating..."):
        client.api = PyiCloudService(
            apple_id, password,
            cookie_directory=str(FindMyClient.COOKIE_DIR),
        )
        client.apple_id = apple_id

    if client.api and client.api.requires_2fa:
        if not client._handle_2fa():
            rprint("[red]2FA verification failed.[/red]")
            sys.exit(1)

    client._save_session(apple_id, password)
    rprint("[green]Logged in successfully![/green]")


@cli.command()
def list():
    """List all devices on your iCloud account"""
    require_auth()
    with console.status("Fetching devices..."):
        devices = client.get_devices()

    if not devices:
        rprint("[yellow]No devices found on your account.[/yellow]")
        return

    table = Table(title="iCloud Devices")
    table.add_column("#", style="dim")
    table.add_column("Name")
    table.add_column("Model")
    table.add_column("Battery", justify="right")
    table.add_column("Status")

    for i, d in enumerate(devices):
        battery = d.get("batteryLevel", 0)
        if battery:
            pct = f"{battery * 100:.0f}%"
        else:
            pct = "N/A"
        status_code = d.get("deviceStatus", "")
        status = "[green]Online[/green]" if status_code == "200" else "[dim]Offline[/dim]"
        device_name = d.get("deviceDisplayName", "Unknown")
        model = d.get("deviceModel", "")
        table.add_row(str(i), device_name, model, pct, status)

    console.print(table)


@cli.command()
@click.argument("device", default="")
def locate(device):
    """Get the current location of a device"""
    require_auth()
    with console.status("Locating device..."):
        dev = client.find_device(device)

    if not dev:
        rprint("[red]No device found matching your query.[/red]")
        return

    try:
        location = dev.location()
    except Exception as e:
        rprint(f"[red]Failed to get location: {e}[/red]")
        return

    if not location or not location.get("latitude"):
        rprint("[yellow]No location data available for this device.[/yellow]")
        return

    lat = location["latitude"]
    lng = location["longitude"]
    ts = location.get("timeStamp", 0) / 1000
    time_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
    accuracy = location.get("horizontalAccuracy", "N/A")
    pos_type = location.get("positionType", "N/A")
    is_old = location.get("isOld", True)

    rprint(f"[bold]{dev['deviceDisplayName']}[/bold]")
    rprint(f"  Latitude:  [cyan]{lat}[/cyan]")
    rprint(f"  Longitude: [cyan]{lng}[/cyan]")
    rprint(f"  Accuracy:  {accuracy}m")
    rprint(f"  Type:      {pos_type}")
    rprint(f"  Time:      {time_str}")
    if is_old:
        rprint("  [yellow](stale location)[/yellow]")
    rprint(f"  [underline]https://www.google.com/maps?q={lat},{lng}[/underline]")


@cli.command()
@click.argument("device", default="")
@click.option("--msg", "-m", default="Find My iPhone Alert", help="Custom message to display")
def sound(device, msg):
    """Play a sound on a device"""
    require_auth()
    with console.status(f"Sending sound alert to device..."):
        dev = client.find_device(device)

    if not dev:
        rprint("[red]No device found matching your query.[/red]")
        return

    try:
        dev.play_sound(subject=msg)
        rprint(f"[green]Sound alert sent to {dev['deviceDisplayName']}![/green]")
    except Exception as e:
        rprint(f"[red]Failed to play sound: {e}[/red]")


@cli.command()
@click.argument("device", default="")
@click.option("--number", "-n", prompt=True, help="Phone number to display for the finder to call")
@click.option(
    "--message", "-m",
    default="This iPhone has been lost. Please call me.",
    help="Message to display on the lock screen",
)
@click.option("--passcode", "-p", default="", help="New 4-digit passcode for the device")
def lost(device, number, message, passcode):
    """Enable Lost Mode on a device"""
    require_auth()

    click.confirm(
        f"This will enable Lost Mode on the device. Are you sure?",
        abort=True,
    )

    with console.status("Enabling Lost Mode..."):
        dev = client.find_device(device)

    if not dev:
        rprint("[red]No device found matching your query.[/red]")
        return

    try:
        dev.lost_device(
            number=number,
            text=message,
            newpasscode=passcode,
        )
        rprint(f"[green]Lost Mode enabled on {dev['deviceDisplayName']}![/green]")
        rprint(f"  Finder will see: \"{message}\"")
        rprint(f"  They can call: {number}")
    except Exception as e:
        rprint(f"[red]Failed to enable Lost Mode: {e}[/red]")


@cli.command()
@click.argument("device", default="")
def status(device):
    """Show detailed status of a device"""
    require_auth()
    with console.status("Fetching device status..."):
        dev = client.find_device(device)

    if not dev:
        rprint("[red]No device found matching your query.[/red]")
        return

    status_data = dev.status()
    rprint(f"[bold]{dev['deviceDisplayName']}[/bold] ({dev.get('name', '')})")

    for key, value in status_data.items():
        if key == "batteryLevel" and value:
            value = f"{value * 100:.0f}%"
        elif key == "deviceStatus":
            value = "Online" if value == "200" else f"Offline ({value})"
        rprint(f"  {key}: {value}")

    extra_keys = [
        "deviceModel", "deviceClass", "modelDisplayName",
        "fmlyShare", "activationLocked", "isLocating",
    ]
    for key in extra_keys:
        value = dev.get(key)
        if value is not None and value != "":
            rprint(f"  {key}: {value}")


if __name__ == "__main__":
    cli()
