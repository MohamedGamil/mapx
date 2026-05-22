(function_call
  prefix: [
    (identifier) @ref.target_call
    (dot_index_expression (identifier) @ref.target_call)
  ]) @ref.type_call
