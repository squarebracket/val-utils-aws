variable "name_ver" {
  description = "string of {name}_v{version}"
  type        = string
}

variable "api_key" {
  description = "api key for henrik"
  type = string
}

variable "api_gateway" {
  type = object({
    id = string
    execution_arn = string
  })
}