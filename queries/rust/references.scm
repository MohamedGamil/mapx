(use_declaration
  argument: (_) @ref.target_import) @ref.type_import

(call_expression
  function: (identifier) @ref.target_call) @ref.type_call

(call_expression
  function: (field_expression
    field: (field_identifier) @ref.target_call)) @ref.type_call

(struct_expression
  name: (type_identifier) @ref.target_instantiation) @ref.type_instantiation
