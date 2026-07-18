---
slug: /features/adtecignore
description: Learn how to use .adtecignore files to control ADTEC Code's file access, protect sensitive information, and manage which files the AI can read or modify.
keywords:
    - adtecignore
    - file access control
    - sensitive data protection
    - gitignore syntax
    - file permissions
    - security
sidebar_label: .adtecignore
---

# Using .adtecignore to Control File Access

The `.adtecignore` file is a key feature for managing ADTEC Code's interaction with your project files. It allows you to specify files and directories that ADTEC Code should not access or modify, similar to how `.gitignore` works for Git.

---

## What is `.adtecignore`?

- **Purpose**: To protect sensitive information, prevent accidental changes to build artifacts or large assets, and generally define ADTEC Code's operational scope within your workspace.
- **How to Use**: Create a file named `.adtecignore` in the root directory of your VS Code workspace. List patterns in this file to tell ADTEC Code which files and directories to ignore.
- **Scope**: `.adtecignore` affects both ADTEC Code's tools and context mentions (like `@directory` attachments).

ADTEC Code actively monitors the `.adtecignore` file. Any changes you make are reloaded automatically, ensuring ADTEC Code always uses the most current rules. The `.adtecignore` file itself is always implicitly ignored, so ADTEC Code cannot change its own access rules.

---

## Pattern Syntax

The syntax for `.adtecignore` is identical to `.gitignore`. Here are common examples:

- `node_modules/`: Ignores the entire `node_modules` directory.
- `*.log`: Ignores all files ending in `.log`.
- `config/secrets.json`: Ignores a specific file.
- `!important.log`: An exception; ADTEC Code will _not_ ignore this specific file, even if a broader pattern like `*.log` exists.
- `build/`: Ignores the `build` directory.
- `docs/**/*.md`: Ignores all Markdown files in the `docs` directory and its subdirectories.

For a comprehensive guide on syntax, refer to the [official Git documentation on .gitignore](https://git-scm.com/docs/gitignore).

---

## How ADTEC Code Tools Interact with `.adtecignore`

`.adtecignore` rules are enforced across various ADTEC Code tools:

### Strict Enforcement (Reads & Writes)

These tools directly check `.adtecignore` before any file operation. If a file is ignored, the operation is blocked:

- [`read_file`](/advanced-usage/available-tools/read-file): Will not read ignored files.
- [`write_to_file`](/advanced-usage/available-tools/write-to-file): Will not write to or create new ignored files.
- [`apply_diff`](/advanced-usage/available-tools/apply-diff): Will not apply diffs to ignored files.

### File Discovery and Listing

- **[`list_files`](/advanced-usage/available-tools/list-files) Tool & `@directory` Attachments**: When ADTEC Code lists files or when you use `@directory` attachments, ignored files are omitted or marked with a 🔒 symbol (see "User Experience" below). Both use identical filtering logic.
- **Environment Details**: Information about your workspace (like open tabs and project structure) provided to ADTEC Code is filtered to exclude or mark ignored items.

### Context Mentions

- **`@directory` Attachments**: Directory contents respect `.adtecignore` patterns. Ignored files are filtered out or marked with `[🔒]` prefix depending on the `show ignored files` setting.
- **Single File Mentions**: Ignored files return "(File is ignored by .adtecignore)" instead of content.

### Command Execution

- **[`execute_command`](/advanced-usage/available-tools/execute-command) Tool**: This tool checks if a command (from a predefined list like `cat` or `grep`) targets an ignored file. If so, execution is blocked.

---

## Key Limitations and Scope

- **Workspace-Centric**: `.adtecignore` rules apply **only to files and directories within the current VS Code workspace root**. Files outside this scope are not affected.
- **[`execute_command`](/advanced-usage/available-tools/execute-command) Specificity**: Protection for `execute_command` is limited to a predefined list of file-reading commands. Custom scripts or uncommon utilities might not be caught.
- **Not a Full Sandbox**: `.adtecignore` is a powerful tool for controlling ADTEC Code's file access via its tools, but it does not create a system-level sandbox.

---

## User Experience and Notifications

- **Visual Cue (🔒)**: In file listings and `@directory` attachments, files ignored by `.adtecignore` may be marked with a lock symbol (🔒), depending on the `show ignored files` setting (defaults to `true`).
- **Ignore Messages**: Single file mentions return "(File is ignored by .adtecignore)" instead of content.
- **Error Messages**: If a tool operation is blocked, ADTEC Code receives an error: `"Access to [file_path] is blocked by the .adtecignore file settings. You must try to continue in the task without using this file, or ask the user to update the .adtecignore file."`
- **Chat Notifications**: You will typically see a notification in the ADTEC Code chat interface when an action is blocked due to `.adtecignore`.

This guide helps you understand the `.adtecignore` feature, its capabilities, and its current limitations, so you can effectively manage ADTEC Code's interaction with your codebase.
