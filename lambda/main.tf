locals {
  name = split("_", var.name_ver)[0]
  ver = split("_", var.name_ver)[1]
  full_name = var.name_ver
}

resource "null_resource" "install_rebuild" {
  triggers = {
    command = filesha256("${path.module}/../${local.full_name}/command.ts")
    package = filesha256("${path.module}/../${local.full_name}/package.json")
  }

  provisioner "local-exec" {
    command = "npm install && npm run build"
    working_dir = "${path.module}/../${local.full_name}/"
  }
}

resource "archive_file" "command_zip" {
  type = "zip"
  output_path = "${local.full_name}.zip"

  source {
    content = replace(file("${path.module}/../${local.full_name}/command.js"), "HDEV-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", var.api_key)
    filename = "index.js"
  }

  source {
    content = file("${path.module}/../${local.full_name}/package.json")
    filename = "package.json"
  }

  depends_on = [ null_resource.install_rebuild ]

}

resource "aws_iam_role" "command_role" {
  name = local.full_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Sid    = ""
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "command_policy" {
  role       = aws_iam_role.command_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "command" {
  filename      = archive_file.command_zip.output_path
  function_name = local.full_name
  role          = aws_iam_role.command_role.arn
  timeout = 30

  source_code_hash = archive_file.command_zip.output_base64sha256

  runtime = "nodejs22.x"
  handler = "index.handler"
}

resource "aws_apigatewayv2_integration" "command" {
  api_id = var.api_gateway.id

  integration_uri    = aws_lambda_function.command.invoke_arn
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "route" {
  api_id = var.api_gateway.id

  route_key = "GET /${local.name}/${local.ver}"
  target    = "integrations/${aws_apigatewayv2_integration.command.id}"
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.command.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${var.api_gateway.execution_arn}/*/*"
}
