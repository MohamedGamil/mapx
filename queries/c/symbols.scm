(struct_specifier
  name: (type_identifier) @symbol.name) @symbol.kind_struct

(function_definition
  declarator: (function_declarator
    declarator: (identifier) @symbol.name)) @symbol.kind_function
