module.exports = grammar({
  name: 'python',

  extras: $ => [
    $.comment,
    /\s/
  ],

  externals: $ => [
    $._newline,
    $._indent,
    $._dedent
  ],

  rules: {
    module: $ => optional(seq(
      repeat1($._statement),
      optional(choice(';', $._newline))
    )),

    _statement: $ => choice(
      seq($._simple_statement, $._newline),
      $._compound_statement
    ),

    // Simple statements

    _simple_statement: $ => choice(
      $.print_statement,
      $.expression_statement
    ),

    print_statement: $ => seq(
      'print',
      $._expression,
      repeat(seq(',', $._expression))
    ),

    expression_statement: $ => $._expression,

    // Compount statements

    _compound_statement: $ => choice(
      $.if_statement,
      $.for_statement,
      $.while_statement
    ),

    if_statement: $ => seq(
      'if',
      $._expression,
      ':',
      $._suite,
      repeat($.elif_clause),
      optional($.else_clause)
    ),

    elif_clause: $ => seq(
      'elif',
      $._expression,
      ':',
      $._suite
    ),

    else_clause: $ => seq(
      'else',
      ':',
      $._suite
    ),

    for_statement: $ => seq(
      'for',
      $.expression_list,
      'in',
      $.expression_list,
      ':',
      $._suite,
      optional($.else_clause)
    ),

    while_statement: $ => seq(
      'while',
      $._expression,
      ':',
      $._suite,
      optional($.else_clause)
    ),

    _suite: $ => choice(
      $._simple_statement,
      seq(
        $._indent,
        repeat($._statement),
        $._dedent
      )
    ),

    expression_list: $ => commaSep1($._expression),

    // Expressions

    _expression: $ => choice(
      $.identifier,
      $.binary_operator
    ),

    binary_operator: $ => choice(
      prec.left(seq($._expression, '+', $._expression))
    ),

    identifier: $ => /\a\w*/,

    comment: $ => token(seq(
      '#',
      /.+/
    ))
  }
})

function commaSep1 (rule) {
  return seq(rule, repeat(seq(',', rule)))
}
