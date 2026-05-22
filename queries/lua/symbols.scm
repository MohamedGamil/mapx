(function_definition
  name: [
    (identifier) @symbol.name
    (dot_index_expression (identifier) @symbol.name)
  ]) @symbol.kind_function
