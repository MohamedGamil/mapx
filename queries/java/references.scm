(import_declaration (scoped_identifier) @ref.target_import) @ref.type_import

(method_invocation
  name: (identifier) @ref.target_call) @ref.type_call

(object_creation_expression
  type: (type_identifier) @ref.target_instantiation) @ref.type_instantiation
