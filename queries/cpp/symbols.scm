(class_specifier
  name: (type_identifier) @symbol.name) @symbol.kind_class

(struct_specifier
  name: (type_identifier) @symbol.name) @symbol.kind_struct

(function_definition
  declarator: (function_declarator
    declarator: [
      (field_identifier) @symbol.name
      (identifier) @symbol.name
    ])) @symbol.kind_function
