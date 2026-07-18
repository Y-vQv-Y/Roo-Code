# ADTEC Code CLI

The ADTEC Code CLI runs the same agent workflow from a terminal.

## Local Installation

Build artifacts are distributed internally. Install a supplied tarball with:

```sh
ADTEC_CODE_LOCAL_TARBALL=/path/to/adtec-code-cli.tar.gz ./install.sh
```

The default executable is `adtec-code` and the default data directory is `~/.adtec/cli`.

## Usage

```sh
adtec-code "Summarize this repository"
adtec-code --print "Explain the current changes"
adtec-code --help
```

An internal release service can be configured with `ADTEC_CODE_RELEASE_REPOSITORY`, `ADTEC_CODE_RELEASES_URL`, and `ADTEC_CODE_INSTALL_COMMAND`.
