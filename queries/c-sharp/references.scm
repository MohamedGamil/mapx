(using_directive name: [(identifier) (qualified_name)] @ref.target_import) @ref.type_import

(invocation_expression
  function: [
    (identifier) @ref.target_call
    (member_access_expression name: (identifier) @ref.target_call)
  ]) @ref.type_call

(object_creation_expression
  type: (_) @ref.target_instantiation) @ref.type_instantiation
