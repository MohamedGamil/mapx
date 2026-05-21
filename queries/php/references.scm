; PHP Reference / Dependency Extraction

(require_once_expression
  (parenthesized_expression
    (string
      (string_content) @ref.target_require))) @ref.type_require

(require_expression
  (parenthesized_expression
    (string
      (string_content) @ref.target_require))) @ref.type_require

(include_once_expression
  (parenthesized_expression
    (string
      (string_content) @ref.target_require))) @ref.type_require

(include_expression
  (parenthesized_expression
    (string
      (string_content) @ref.target_require))) @ref.type_require

(namespace_use_declaration
  (namespace_use_clause
    (name) @ref.target_import)) @ref.type_import

(class_declaration
  (base_clause
    (name) @ref.target_extends)) @ref.type_extends

(class_declaration
  (class_interface_clause
    (name) @ref.target_implements)) @ref.type_implements

(object_creation_expression
  (name) @ref.target_instantiation) @ref.type_instantiation

(scoped_call_expression
  scope: (name) @ref.target_call) @ref.type_call

(member_call_expression
  name: (name) @ref.target_call) @ref.type_call
