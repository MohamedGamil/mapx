(call
  target: (identifier) @target_defmodule
  (#eq? @target_defmodule "defmodule")
  arguments: (arguments (alias) @symbol.name)) @symbol.kind_module

(call
  target: (identifier) @target_def
  (#match? @target_def "^defp?$")
  arguments: (arguments (call target: (identifier) @symbol.name))) @symbol.kind_function
