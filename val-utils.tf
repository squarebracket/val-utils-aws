terraform {
  backend "s3" {
    bucket = "tf-abc123"
    region = "us-east-2"
    key = "val-utils.tfstate"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.98.0"
    }
  }
}

variable "api_key" {
  type = string
}

variable "commands" {
  type = set(string)
  default = [
    "record_v1",
    "rank_v1"
  ]
}

resource "aws_apigatewayv2_api" "valorant_utils" {
  name        = "valorant_utils"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "valorant_utils_prod" {
  api_id = aws_apigatewayv2_api.valorant_utils.id

  name        = "prod"
  auto_deploy = true
}

module "commands" {
  source  = "./lambda"

  for_each = var.commands
  name_ver = each.value
  api_key = var.api_key
  api_gateway = aws_apigatewayv2_api.valorant_utils
}

output "urls" {
  value = {
    for k, v in module.commands : k => "${aws_apigatewayv2_stage.valorant_utils_prod.invoke_url}${v.url}"
  }
}
