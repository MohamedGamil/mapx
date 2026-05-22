(class_declaration
  name: (type_identifier) @symbol.name) @symbol.kind_class

(struct_declaration
  name: (type_identifier) @symbol.name) @symbol.kind_struct

(function_declaration
  name: (navigation_suffix) @symbol.name) @symbol.kind_function

(function_declaration
  name: (simple_identifier) @symbol.name) @symbol.kind_function
