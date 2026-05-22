(import_spec path: (_) @ref.target_import) @ref.type_import

(call_expression
  function: (identifier) @ref.target_call) @ref.type_call

(call_expression
  function: (selector_expression
    field: (field_identifier) @ref.target_call)) @ref.type_call

(composite_literal
  type: (type_identifier) @ref.target_instantiation) @ref.type_instantiation
