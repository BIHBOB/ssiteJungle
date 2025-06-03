const onLoginSubmit = (data: LoginValues) => {
  try {
    console.log("Отправка данных входа:", data);
    loginMutation.mutate(data);
  } catch (error) {
    console.error("Login error:", error);
  }
};

const onRegisterSubmit = (data: RegisterValues) => {
  try {
    // Remove confirmPassword as it's not part of the API schema
    const { confirmPassword, ...registerData } = data;
    
    // Убедимся, что все необходимые поля заполнены
    const userData = {
      ...registerData,
      username: registerData.username || registerData.email.split('@')[0],
      phone: registerData.phone || '',
      address: registerData.address || ''
    };
    
    console.log("Отправка данных регистрации:", userData);
    registerMutation.mutate(userData);
  } catch (error) {
    console.error("Registration error:", error);
  }
}; 