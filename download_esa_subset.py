import argparse
import io
import json
import re
import urllib.error
import urllib.request
import zipfile
from pathlib import Path


class HttpRangeReader(io.RawIOBase):
    def __init__(self, url, size, block_size=4 * 1024 * 1024):
        self.url = url
        self.size = size
        self.block_size = block_size
        self.position = 0
        self.cache_start = -1
        self.cache = b""

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=io.SEEK_SET):
        if whence == io.SEEK_CUR:
            offset += self.position
        elif whence == io.SEEK_END:
            offset += self.size
        elif whence != io.SEEK_SET:
            raise ValueError("invalid seek origin")
        if offset < 0:
            raise ValueError("negative seek position")
        self.position = min(offset, self.size)
        return self.position

    def read(self, size=-1):
        if size is None or size < 0:
            size = self.size - self.position
        size = min(size, self.size - self.position)
        chunks = []
        remaining = size

        while remaining:
            block_start = self.position // self.block_size * self.block_size
            if not (self.cache_start <= self.position <
                    self.cache_start + len(self.cache)):
                block_end = min(self.size, block_start + self.block_size) - 1
                request = urllib.request.Request(
                    self.url,
                    headers={"Range": "bytes={}-{}".format(block_start,
                                                             block_end)})
                for attempt in range(5):
                    try:
                        with urllib.request.urlopen(request, timeout=90) as response:
                            if response.status != 206:
                                raise OSError(
                                    "server did not honor HTTP byte ranges")
                            self.cache = response.read()
                        break
                    except (urllib.error.URLError, TimeoutError, OSError):
                        if attempt == 4:
                            raise
                self.cache_start = block_start

            cache_offset = self.position - self.cache_start
            count = min(remaining, len(self.cache) - cache_offset)
            if count <= 0:
                raise OSError("received an incomplete HTTP byte range")
            chunks.append(self.cache[cache_offset:cache_offset + count])
            self.position += count
            remaining -= count

        return b"".join(chunks)


def main():
    parser = argparse.ArgumentParser(
        description="Read selected ESA mission ZIP members using HTTP ranges.")
    parser.add_argument("--record", default="15237121")
    parser.add_argument("--mission", type=int, default=1, choices=(1, 2, 3))
    parser.add_argument("--channels", default="",
                        help="comma-separated channel numbers; omit for metadata only")
    parser.add_argument("--output-dir", type=Path,
                        default=Path("datasets/esa-anomaly-dataset/data/subset"))
    parser.add_argument("--list", action="store_true",
                        help="list archive metadata and channel member sizes")
    args = parser.parse_args()

    base = "https://zenodo.org/records/{}/files/ESA-Mission{}.zip?download=1"\
        .format(args.record, args.mission)
    with urllib.request.urlopen(
            "https://zenodo.org/api/records/{}".format(args.record),
            timeout=60) as response:
        record = json.load(response)
    archive = next(file for file in record["files"]
                   if file["key"] == "ESA-Mission{}.zip".format(args.mission))
    reader = HttpRangeReader(base, archive["size"])

    with zipfile.ZipFile(reader) as mission_zip:
        members = mission_zip.infolist()
        if args.list:
            for member in members:
                if (member.filename.endswith(".csv") or
                        re.search(r"/channels/channel_\d+\.zip$", member.filename)):
                    print("{}\t{}\t{}".format(
                        member.file_size, member.compress_type, member.filename))
            return

        selected = [member for member in members
                    if member.filename.endswith(("labels.csv",
                                                 "anomaly_types.csv"))]
        channel_numbers = {
            int(item) for item in args.channels.split(",") if item.strip()
        }
        if channel_numbers:
            selected.extend(
                member for member in members
                if (match := re.search(
                    r"/channels/channel_(\d+)\.zip$", member.filename))
                and int(match.group(1)) in channel_numbers)

        args.output_dir.mkdir(parents=True, exist_ok=True)
        for member in selected:
            destination = args.output_dir / member.filename
            destination.parent.mkdir(parents=True, exist_ok=True)
            with mission_zip.open(member) as source, destination.open("wb") as target:
                while chunk := source.read(1024 * 1024):
                    target.write(chunk)
            print("Downloaded {} ({} bytes)".format(
                member.filename, member.file_size))


if __name__ == "__main__":
    main()