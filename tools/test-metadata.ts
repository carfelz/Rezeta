import 'reflect-metadata'

function Injectable(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('injectable', true, target)
  }
}

function Controller(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('controller', true, target)
  }
}

@Injectable()
class MyService {
  constructor() {}
}

@Controller()
class MyController {
  constructor(public service: MyService) {}
}

const paramTypes = Reflect.getMetadata('design:paramtypes', MyController)
console.log('Param types:', paramTypes)
console.log('MyService is in param types:', paramTypes?.[0] === MyService)
